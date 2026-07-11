import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Home, Info, XCircle } from 'lucide-react';
import { cx } from './utils';

export type OutcomeStatus = 'success' | 'declined' | 'pending' | 'error';

export interface OutcomeDetail {
  id: string;
  label: string;
  value: ReactNode;
}

export interface OutcomeAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface OutcomeScreenProps {
  status: OutcomeStatus;
  title: string;
  description?: string;
  reference?: string;
  details?: readonly OutcomeDetail[];
  primaryAction?: OutcomeAction;
  secondaryAction?: OutcomeAction;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const outcomeConfig: Record<OutcomeStatus, { icon: typeof CheckCircle2; accent: string; surface: string; eyebrow: string }> = {
  success: { icon: CheckCircle2, accent: 'text-emerald-600 dark:text-emerald-300', surface: 'bg-emerald-50 dark:bg-emerald-950/40', eyebrow: 'Konfirmasi berhasil' },
  declined: { icon: Info, accent: 'text-zinc-600 dark:text-zinc-300', surface: 'bg-zinc-100 dark:bg-zinc-800', eyebrow: 'Jawaban tersimpan' },
  pending: { icon: Clock3, accent: 'text-amber-600 dark:text-amber-300', surface: 'bg-amber-50 dark:bg-amber-950/40', eyebrow: 'Menunggu penyelesaian' },
  error: { icon: XCircle, accent: 'text-rose-600 dark:text-rose-300', surface: 'bg-rose-50 dark:bg-rose-950/40', eyebrow: 'Belum berhasil' },
};

export function OutcomeScreen({
  status,
  title,
  description,
  reference,
  details = [],
  primaryAction,
  secondaryAction,
  icon,
  children,
  className,
}: OutcomeScreenProps) {
  const config = outcomeConfig[status];
  const StatusIcon = config.icon;

  return (
    <section aria-labelledby="outcome-title" aria-live="polite" className={cx('mx-auto w-full max-w-2xl text-center', className)}>
      <div className="relative overflow-hidden rounded-[2.25rem] border border-zinc-200 bg-white px-5 py-9 shadow-[0_32px_90px_-45px_rgba(24,24,27,0.6)] sm:px-10 sm:py-12 dark:border-zinc-800 dark:bg-zinc-900">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-indigo-500/5 blur-2xl" />
        <div className={cx('relative mx-auto flex size-20 items-center justify-center rounded-[1.75rem] shadow-sm', config.surface, config.accent)}>
          {icon ?? <StatusIcon aria-hidden="true" className="size-10" />}
        </div>

        <p className={cx('relative mt-6 text-[11px] font-black uppercase tracking-[0.2em]', config.accent)}>{config.eyebrow}</p>
        <h1 id="outcome-title" className="relative mx-auto mt-3 max-w-xl text-3xl font-black leading-tight tracking-[-0.03em] text-zinc-950 sm:text-4xl dark:text-white">{title}</h1>
        {description ? <p className="relative mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-500 sm:text-base dark:text-zinc-400">{description}</p> : null}
        {reference ? <p className="relative mx-auto mt-4 inline-flex rounded-full bg-zinc-100 px-3 py-1.5 font-mono text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Ref: {reference}</p> : null}

        {details.length > 0 ? (
          <dl className="relative mt-8 grid gap-3 text-left sm:grid-cols-2">
            {details.map(detail => (
              <div key={detail.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/45">
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{detail.label}</dt>
                <dd className="mt-1.5 text-sm font-bold text-zinc-900 dark:text-white">{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {children ? <div className="relative mt-8 text-left">{children}</div> : null}

        {(primaryAction || secondaryAction) ? (
          <div className="relative mt-9 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            {secondaryAction ? (
              <button type="button" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900">
                <Home aria-hidden="true" className="size-4" />
                {secondaryAction.label}
              </button>
            ) : null}
            {primaryAction ? (
              <button type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-indigo-300 dark:focus-visible:ring-offset-zinc-900">
                {primaryAction.label}
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default OutcomeScreen;

