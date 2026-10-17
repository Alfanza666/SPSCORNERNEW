import React from 'react';
import { Check, Clock, CreditCard, PackageCheck, XCircle } from 'lucide-react';

/**
 * OrderStatusTimeline — status pesanan sebagai step visual (bukan badge teks).
 * Status: pending → paid/success → completed. failed/cancelled ditampilkan merah.
 */
export default function OrderStatusTimeline({ status }: { status: string }) {
  const normalized = String(status || '').toLowerCase();
  const isFailed = normalized === 'failed' || normalized === 'cancelled' || normalized === 'expired';
  const currentIndex = normalized === 'pending' || normalized === 'processing'
    ? 0
    : normalized === 'paid' || normalized === 'success'
      ? 1
      : normalized === 'completed' || normalized === 'done'
        ? 2
        : 0;

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-400">
        <XCircle className="h-4 w-4" />
        <span className="text-[11px] font-black uppercase tracking-wider">
          {normalized === 'cancelled' ? 'Dibatalkan' : 'Gagal'}
        </span>
      </div>
    );
  }

  const steps = [
    { label: 'Menunggu Bayar', icon: CreditCard },
    { label: 'Terverifikasi', icon: Clock },
    { label: 'Selesai', icon: PackageCheck },
  ];

  return (
    <div className="flex items-center" role="list" aria-label="Status pesanan">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const Icon = step.icon;
        return (
          <React.Fragment key={step.label}>
            <div role="listitem" className="flex flex-col items-center gap-1" aria-current={active ? 'step' : undefined}>
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-200',
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : active
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'border-zinc-200 bg-white text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600',
                ].join(' ')}
              >
                {done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={[
                  'whitespace-nowrap text-[9px] font-bold',
                  done
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : active
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-zinc-400 dark:text-zinc-500',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={[
                  'mx-1 mb-4 h-0.5 w-6 rounded-full sm:w-8',
                  index < currentIndex ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700',
                ].join(' ')}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
